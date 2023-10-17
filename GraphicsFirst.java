

import acm.graphics.*;
import acm.program.GraphicsProgram;

public class GraphicsFirst extends GraphicsProgram {

	public void run(){
		GRect myRect = new GRect(100,100); 
		GRect myRect2 = new GRect(20,20); 
		GRect myRect3 = new GRect(20,20); 
		GRect myRect4 = new GRect(20,40); 
		GLine myLine = new GLine(0,0,50,100);
		GLine myLine6 = new GLine(0,0,50,100);
		GLine myLine2 = new GLine(0,100,50,0);
		GLine myLine3 = new GLine(0,50,150,0);
		GLine myLine4 = new GLine(0,50,150,0);
		GLine myLine5 = new GLine(0,50,150,0);
		GLine myLine7 = new GLine(0,0,0,100);
		GOval firstWheel = new GOval(30,30);
		GOval secondWheel = new GOval(30,30);
		GLine floor = new GLine(0,0,40,0);
		GLine floor1 = new GLine(0,0,10,0);
		GLine floor2 = new GLine(0,0,10,0);
		GLine roof = new GLine(0,0,30,0);
		GLine right = new GLine(0,20,0,0);
		GLine left = new GLine(0,20,0,0);
	//	add(new GRect(100,100),200,200);
	add(myRect,100,200);
	add(myLine, 150,100);
	add(myRect2,120,220);
	add(myRect3,160,220);
	add(myRect4,140,260);
	add(myLine2, 100,200);
	add(myLine3, 150,100);
	add(myLine4, 200,200);
	add(myLine5, 200,300);
	add(myLine6, 300,50);
	add(myLine7, 350,150);
	add(firstWheel, 450,270);
	add(secondWheel, 520,270);
	add(floor,480,285);
	add(floor1,440,285);
	add(floor2,550,285);
	add(right, 560,285);
	add(left, 440,285);
	}
	
}
