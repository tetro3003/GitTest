

import acm.graphics.*;
import acm.graphics.GRect;
import acm.program.GraphicsProgram;

public class Pr21 extends GraphicsProgram {
	
	public void run(){
		
	
		
		
			
		//	GLine horizontalLine = new GLine(0,0,100,0); 
				
			for(int a = 0; a<9; a++){
				
				GLine horizontalLine = new GLine(0,0,100,0); 
				
				add(horizontalLine, 0, a*10+10);
				
				
				
			}
			
			for(int a = 0; a<9; a++){
				
				GLine verticalLine = new GLine(0,0,0,100); 
				
				add(verticalLine, a*10+10, 0);
				
				
				
			}
			
			
		}
}
	


