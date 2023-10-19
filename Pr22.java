import java.awt.Color;

import acm.graphics.GRect;
import acm.program.GraphicsProgram;

public class Pr22 extends GraphicsProgram {
	
	public void run(){
		
		for(int a = 0; a<10; a++){
			
			for(int b = 0; b<10; b++){
				
				if(a%2==0&&b%2==0){
				GRect rect = new GRect(20,20);
				rect.setColor(Color.black);;
				add(rect, b*20, a*20);
				
				} else if(a%2==1&&b%2==0){
					GRect rect = new GRect(20,20);
					add(rect, b*20, a*20);
					
				} else if(a%2==0&&b%2==1){
					GRect rect = new GRect(20,20);
					add(rect, b*20, a*20);
						
				} else if(a%2==1&&b%2==1){
					GRect rect = new GRect(20,20);
					rect.setColor(Color.black);;
					add(rect, b*20, a*20);
							
							}
				
			
			}
			
		}

	}
}