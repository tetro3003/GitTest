import java.awt.Color;

import acm.graphics.GRect;
import acm.program.GraphicsProgram;

public class Pr22 extends GraphicsProgram {
	
	public void run(){
		
		for(int a = 0; a<8; a++){
			
			for(int b = 0; b<8; b++){
				
					   if(a%2==0&&b%2==0){
					GRect rect = new GRect(40,40);
					rect.setFillColor(Color.black);;
					add(rect, b*40, a*40);
				
				} else if(a%2==1&&b%2==0){
					GRect rect = new GRect(40,40);
					add(rect, b*40, a*40);
					
				} else if(a%2==0&&b%2==1){
					GRect rect = new GRect(40,40);
					add(rect, b*40, a*40);
						
				} else if(a%2==1&&b%2==1){
					GRect rect = new GRect(40,40);
					rect.setFillColor(Color.black);
					add(rect, b*40, a*40);
				}			
						
			
			}
			
		}

	}
}